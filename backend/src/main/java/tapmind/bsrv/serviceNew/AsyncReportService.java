
package tapmind.bsrv.serviceNew;
import org.springframework.stereotype.Service;
import org.springframework.beans.factory.annotation.Autowired;

import tapmind.bsrv.repository.UserRepository;

import tapmind.bsrv.model.User;
import tapmind.bsrv.dto.*;

import java.util.*;
import java.io.ByteArrayOutputStream;
import java.io.Writer;
import java.io.OutputStreamWriter;
import java.nio.charset.StandardCharsets;
import org.json.JSONArray;
import tapmind.bsrv.service.Mailer;
import org.springframework.scheduling.annotation.Async;


import tapmind.bsrv.repository.UserWorkDataRepository;
import tapmind.bsrv.model.UserWorkData;
import tapmind.bsrv.service.EmailService;
import tapmind.bsrv.model.*;
import tapmind.bsrv.repository.*;
import tapmind.bsrv.dto.UserWorkDataResponseWrapperDTO.UserWorkDataResponseDTO;

@Service
public class AsyncReportService {

    @Autowired
    private UserWorkDataRepository userWorkDataRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private EmailService emailService;

        @Autowired
    private DepartmentRepository departmentRepository;

    @Autowired
    private DepartmentTargetRepository targetRepository;

    @Autowired
    private DepartmentTaskRepository taskRepository;
  

   @Async
public void generateCsvAndSendEmail(UserWorkDataFilterRequestDTO filter) {
    try {
        // 1️⃣ Fetch list
        List<UserWorkData> list = userWorkDataRepository.findFilteredWorkData(
                filter.getUserID(),
                filter.getDepartmentID(),
                filter.getStartDate(),
                filter.getEndDate(),
                filter.getIsForTarget(),
                filter.getTaskID(),
                filter.getELID()
        );

        // 2️⃣ Build CSV content (StringBuilder, not FileWriter)
        StringBuilder csv = new StringBuilder();

        csv.append("DailyTaskLogID,UserID,UserName,DepartmentID,DepartmentName,TaskID,TaskName,")
           .append("WorkDate,SetUp,Units,AllocatedTime,TimeTakenToWork,IsForTarget,OverAllTime,Remarks,")
           .append("AchievedUnits,TotalUnitValues,CreatedAt,UpdatedAt\n");

        for (UserWorkData entity : list) {

            UserWorkDataResponseWrapperDTO.UserWorkDataResponseDTO dto =
                    this.mapToResponse(entity);

            csv.append(dto.getDailyTaskLogID()).append(",");
            csv.append(dto.getUserID()).append(",");
            csv.append(s(dto.getUserName())).append(",");
            csv.append(dto.getDepartmentID()).append(",");
            csv.append(s(dto.getDepartmentName())).append(",");
            csv.append(dto.getTaskID()).append(",");
            csv.append(s(dto.getTaskName())).append(",");
            csv.append(dto.getWorkDate()).append(",");
            csv.append(dto.getSetUp()).append(",");
            csv.append(dto.getUnits()).append(",");
            csv.append(dto.getAllocatedTime()).append(",");
            csv.append(dto.getTimeTakenToWork()).append(",");
            csv.append(dto.getIsForTarget()).append(",");
            csv.append(dto.getOverAllTime()).append(",");
            csv.append("\"").append(s(dto.getRemarks())).append("\",");
            csv.append(dto.getAchivedUnits()).append(",");
            csv.append(dto.getTotalUnitValues()).append(",");
            csv.append(dto.getCreatedAt()).append(",");
            csv.append(dto.getUpdatedAt()).append("\n");
        }

        // 3️⃣ Convert CSV → ByteArrayOutputStream for attachment
        ByteArrayOutputStream arr = new ByteArrayOutputStream();
        try (Writer writer = new OutputStreamWriter(arr, StandardCharsets.UTF_8)) {
            writer.write(csv.toString());
            writer.flush();
        }

        // 4️⃣ Prepare attachment as per your Mailer.Attachment POJO
        Mailer.Attachment attachment = new Mailer.Attachment();
        attachment.fileName = "UserWorkData_" + System.currentTimeMillis() + ".csv";
        attachment.contentType = "text/csv";
        attachment.content = arr.toByteArray();

        List<Mailer.Attachment> attachments = new ArrayList<>();
        attachments.add(attachment);

        // 5️⃣ Prepare email
        String emailOpt = userRepository.findEmailByUserId(filter.getUserID());
        if (emailOpt.isEmpty()) {
            System.err.println("No email found for userID " + filter.getUserID());
            return;
        }

        JSONArray to = new JSONArray();
        JSONArray cc = new JSONArray();

        to.put(emailOpt);
        cc.put("ravindra.reddy@tapmind.com");
        cc.put("vasu.madhavarapu@tapmind.com");
       

        String subject = "Your User Work Data Export";
        StringBuilder body = new StringBuilder();
        body.append("<p>Hello,</p>");
        body.append("<p>Please find your work data export attached.</p>");
        body.append("<p>Regards,<br/>Team Streamlyn</p>");

        // 6️⃣ Send email
        Mailer mailer = new Mailer();
        mailer.send(to, cc, subject, body.toString(), attachments);

    } catch (Exception e) {
        e.printStackTrace();
        System.err.println("ERROR in async CSV generation + email: " + e.getMessage());
    }
}


    private String s(String val) {
        return val == null ? "" : val.replace(",", " ");
    }

    public  UserWorkDataResponseDTO mapToResponse(UserWorkData entity) {

    // -------------------------
    // 1. USER NAME
    // -------------------------
    String userName = userRepository.findById(entity.getUserID())
            .map(User::getName)
            .orElse(null);

    // -------------------------
    // 2. DEPARTMENT NAME
    // -------------------------
    String departmentName = departmentRepository.findById(entity.getDepartmentID())
            .map(Department::getDepartmentName)
            .orElse(null);

    // -------------------------
    // 3. TASK NAME (VERY IMPORTANT LOGIC)
    // -------------------------
    String taskName;

    if (Boolean.FALSE.equals(entity.getIsForTarget())) {
        // Fetch from Task table
        taskName = taskRepository.findById(entity.getTaskID())
                .map(DepartmentTask::getTaskName)
                .orElse(null);
    } else {
        // Fetch from Target table
        taskName = targetRepository.findById(entity.getTaskID())
                .map(DepartmentTarget::getTargetName)
                .orElse(null);
    }

    // -------------------------
    // 4. BUILD DTO
    // -------------------------
    return UserWorkDataResponseDTO.builder()
            .dailyTaskLogID(entity.getDailyTaskLogID())
            .taskID(entity.getTaskID())
            .taskName(taskName)                  // <-- added
            .userID(entity.getUserID())
            .userName(userName)
            .departmentID(entity.getDepartmentID())
            .departmentName(departmentName)
            .workDate(entity.getWorkDate())
            .setUp(entity.getSetUp())            // <-- correct
            .units(entity.getUnits())            // <-- correct
            .allocatedTime(entity.getAllocatedTime())
            .timeTakenToWork(entity.getTimeTakenToWork())
            .isForTarget(entity.getIsForTarget())
            .overAllTime(entity.getOverAllTime())
            .remarks(entity.getRemarks())
            .achivedUnits((Integer)entity.getAchivedUnits())
            .totalUnitValues(entity.getTotalUnitValues())
            .createdAt(entity.getCreatedAt())
            .updatedAt(entity.getUpdatedAt())
            .build();
}
}
