// package tapmind.bsrv.serviceNew;

// import lombok.RequiredArgsConstructor;
// import org.springframework.stereotype.Service;
// import tapmind.bsrv.dto.TaskEntryStatusDTO;
// import tapmind.bsrv.model.Department;
// import tapmind.bsrv.model.User;
// import tapmind.bsrv.repository.DepartmentRepository;
// import tapmind.bsrv.repository.UserRepository;
// import tapmind.bsrv.repository.UserWorkDataRepository;
// import tapmind.bsrv.service.EmailService;
// import org.springframework.transaction.annotation.Transactional;
// import java.time.LocalDate;
// import java.util.ArrayList;
// import java.util.HashSet;
// import java.util.List;
// import java.util.Set;

// @Service
// @RequiredArgsConstructor
// public class TaskEntryAuditService {

//     private final DepartmentRepository departmentRepository;

//     private final UserRepository userRepository;

//     private final UserWorkDataRepository userWorkDataRepository;

//     private final EmailService emailService;

//     @Transactional
//     public void auditDepartmentTaskEntries() {

//         System.out.println("========== DAILY TASK AUDIT STARTED ==========");

//         LocalDate workDate = LocalDate.now().minusDays(1);
//         List<Department> departments = departmentRepository.findAll();

//         System.out.println("Total Departments : " + departments.size());

//         for (Department department : departments) {

//             try {

//                 System.out.println(
//                         "\nChecking Department : "
//                                 + department.getDepartmentName());

//                 List<User> departmentUsers = userRepository.findUsersByDepartmentId(
//                         department.getDepartmentID());

//                 System.out.println(
//                         "Users Found : " + departmentUsers.size());

//                 List<TaskEntryStatusDTO> submittedUsers = new ArrayList<>();

//                 User reportingManager = null;

//                 User elManager = null;

//                 for (User user : departmentUsers) {

//                     try {

//                         System.out.println(
//                                 "Checking User : "
//                                         + user.getName());

//                         boolean isTaskEntered = userWorkDataRepository
//                                 .existsByUserIDAndWorkDate(
//                                         user.getUserID(),
//                                         workDate);

//                         System.out.println(
//                                 "Task Entered : "
//                                         + isTaskEntered);

//                         if (isTaskEntered) {

//                             submittedUsers.add(
//                                     new TaskEntryStatusDTO(
//                                             user.getUserID(),
//                                             user.getName()));

//                             if (reportingManager == null
//                                     && user.getReportingManager() != null) {

//                                 reportingManager = user.getReportingManager();
//                             }

//                             if (elManager == null
//                                     && user.getElManager() != null) {

//                                 elManager = user.getElManager();
//                             }
//                         }

//                     } catch (Exception e) {

//                         System.out.println(
//                                 "Error while checking user : "
//                                         + user.getName());

//                         e.printStackTrace();
//                     }
//                 }

//                 if (!submittedUsers.isEmpty()) {

//                     Set<String> emails = new HashSet<>();

//                     if (reportingManager != null
//                             && reportingManager.getUserEmail() != null) {

//                         emails.add(
//                                 reportingManager.getUserEmail());
//                     }

//                     if (elManager != null
//                             && elManager.getUserEmail() != null) {

//                         emails.add(
//                                 elManager.getUserEmail());
//                     }

//                     System.out.println(
//                             "Emails To Send : " + emails);

//                     if (!emails.isEmpty()) {

//                         StringBuilder body = new StringBuilder();

//                         body.append("<h3>These are the users who logged their tasks on ")
//                                 .append(workDate)
//                                 .append("</h3>");

//                         body.append("<br>");

//                         body.append("<b>Department :</b> ")
//                                 .append(
//                                         department.getDepartmentName());

//                         body.append("<br><br>");

//                         body.append(
//                                 "<table border='1' "
//                                         + "cellpadding='8' "
//                                         + "cellspacing='0'>");

//                         body.append(
//                                 "<tr>"
//                                         + "<th>User ID</th>"
//                                         + "<th>User Name</th>"
//                                         + "</tr>");

//                         for (TaskEntryStatusDTO dto : submittedUsers) {

//                             body.append("<tr>");

//                             body.append("<td>")
//                                     .append(dto.getUserID())
//                                     .append("</td>");

//                             body.append("<td>")
//                                     .append(dto.getEmployeeName())
//                                     .append("</td>");

//                             body.append("</tr>");
//                         }

//                         body.append("</table>");

//                         System.out.println(
//                                 "Sending Mail...");

//                         emailService.sendTaskEntryMail(
//                                 new ArrayList<>(emails),
//                                 "Daily Task Entry Report - "
//                                         + department.getDepartmentName(),
//                                 body.toString());

//                         System.out.println(
//                                 "MAIL SENT SUCCESSFULLY");

//                     } else {

//                         System.out.println(
//                                 "No Manager Emails Found");
//                     }

//                 } else {

//                     System.out.println(
//                             "No Users Submitted Task");
//                 }

//             } catch (Exception e) {

//                 System.out.println(
//                         "Error in Department : "
//                                 + department.getDepartmentName());

//                 e.printStackTrace();
//             }
//         }

//         System.out.println(
//                 "========== DAILY TASK AUDIT COMPLETED ==========");
//     }
// }

package tapmind.bsrv.serviceNew;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import tapmind.bsrv.dto.TaskEntryStatusDTO;
import tapmind.bsrv.model.Department;
import tapmind.bsrv.model.User;
import tapmind.bsrv.repository.DepartmentRepository;
import tapmind.bsrv.repository.UserRepository;
import tapmind.bsrv.repository.UserWorkDataRepository;
import tapmind.bsrv.service.EmailService;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class TaskEntryAuditService {

    private final DepartmentRepository departmentRepository;

    private final UserRepository userRepository;

    private final UserWorkDataRepository userWorkDataRepository;

    private final EmailService emailService;

    @Transactional
    public void auditDepartmentTaskEntries() {

        System.out.println("========== DAILY TASK AUDIT STARTED ==========");

        LocalDate workDate = LocalDate.now().minusDays(1);

        List<Department> departments = departmentRepository.findAll();

        System.out.println("Total Departments : " + departments.size());

        for (Department department : departments) {

            try {

                System.out.println(
                        "\nChecking Department : "
                                + department.getDepartmentName());

                List<User> departmentUsers = userRepository.findUsersByDepartmentId(
                        department.getDepartmentID());

                System.out.println(
                        "Users Found : " + departmentUsers.size());

                List<TaskEntryStatusDTO> submittedUsers = new ArrayList<>();

                List<TaskEntryStatusDTO> pendingUsers = new ArrayList<>();

                User reportingManager = null;

                User elManager = null;

                for (User user : departmentUsers) {

                    try {

                        System.out.println(
                                "Checking User : "
                                        + user.getName());

                        boolean isTaskEntered = userWorkDataRepository
                                .existsByUserIDAndWorkDate(
                                        user.getUserID(),
                                        workDate);

                        System.out.println(
                                "Task Entered : "
                                        + isTaskEntered);

                        if (isTaskEntered) {

                            submittedUsers.add(
                                    new TaskEntryStatusDTO(
                                            user.getUserID(),
                                            user.getName()));

                        } else {

                            pendingUsers.add(
                                    new TaskEntryStatusDTO(
                                            user.getUserID(),
                                            user.getName()));
                        }

                        if (reportingManager == null
                                && user.getReportingManager() != null) {

                            reportingManager = user.getReportingManager();
                        }

                        if (elManager == null
                                && user.getElManager() != null) {

                            elManager = user.getElManager();
                        }

                    } catch (Exception e) {

                        System.out.println(
                                "Error while checking user : "
                                        + user.getName());

                        e.printStackTrace();
                    }
                }

                Set<String> emails = new HashSet<>();

                if (reportingManager != null
                        && reportingManager.getUserEmail() != null) {

                    emails.add(
                            reportingManager.getUserEmail());
                }

                if (elManager != null
                        && elManager.getUserEmail() != null) {

                    emails.add(
                            elManager.getUserEmail());
                }

                System.out.println(
                        "Emails To Send : " + emails);

                if (!emails.isEmpty()) {

                    StringBuilder body = new StringBuilder();

                    body.append("<p>Dear Managers,</p>");

                    body.append("<p>");
                    body.append(
                            "The following employees submitted their data in Taskly yesterday. ");
                    body.append(
                            "Kindly review the entries for your respective teams and approve their tasks.");
                    body.append("</p>");

                    body.append("<br>");

                    body.append(
                            "<table border='1' cellpadding='8' cellspacing='0' ")
                            .append(
                                    "style='border-collapse: collapse; width: 100%;'>");

                    body.append("<tr>")
                            .append("<th>Submitted Employees</th>")
                            .append("<th>Department</th>")
                            .append("</tr>");

                    if (!submittedUsers.isEmpty()) {

                        for (TaskEntryStatusDTO dto : submittedUsers) {

                            body.append("<tr>");

                            body.append("<td>")
                                    .append(dto.getEmployeeName())
                                    .append("</td>");

                            body.append("<td>")
                                    .append(department.getDepartmentName())
                                    .append("</td>");

                            body.append("</tr>");
                        }

                    } else {

                        body.append("<tr>")
                                .append("<td colspan='2'>")
                                .append("No Employees Submitted Tasks")
                                .append("</td>")
                                .append("</tr>");
                    }

                    body.append("</table>");

                    body.append("<br><br>");

                    body.append("<p>");
                    body.append(
                            "Please also note that the following employees are yet to update their data in Taskly.");
                    body.append("</p>");

                    body.append("<br>");

                    body.append(
                            "<table border='1' cellpadding='8' cellspacing='0' ")
                            .append(
                                    "style='border-collapse: collapse; width: 100%;'>");

                    body.append("<tr>")
                            .append("<th>Pending Employees</th>")
                            .append("<th>Department</th>")
                            .append("</tr>");

                    if (!pendingUsers.isEmpty()) {

                        for (TaskEntryStatusDTO dto : pendingUsers) {

                            body.append("<tr>");

                            body.append("<td>")
                                    .append(dto.getEmployeeName())
                                    .append("</td>");

                            body.append("<td>")
                                    .append(department.getDepartmentName())
                                    .append("</td>");

                            body.append("</tr>");
                        }

                    } else {

                        body.append("<tr>")
                                .append("<td colspan='2'>")
                                .append("No Pending Employees")
                                .append("</td>")
                                .append("</tr>");
                    }

                    body.append("</table>");

                    body.append("<br><br>");

                    body.append("<p>");
                    body.append("Regards,<br>");
                    body.append("Taskly Team");
                    body.append("</p>");

                    body.append("<br>");

                    body.append("<small>");
                    body.append(
                            "N.B.: This is an automated email. Please do not reply to this message.");
                    body.append("</small>");

                    System.out.println("Sending Mail...");

                    emailService.sendTaskEntryMail(
                            new ArrayList<>(emails),
                            "Daily Task Entry Report - "
                                    + department.getDepartmentName(),
                            body.toString());

                    System.out.println(
                            "MAIL SENT SUCCESSFULLY");

                } else {

                    System.out.println(
                            "No Manager Emails Found");
                }

            } catch (Exception e) {

                System.out.println(
                        "Error in Department : "
                                + department.getDepartmentName());

                e.printStackTrace();
            }
        }

        System.out.println(
                "========== DAILY TASK AUDIT COMPLETED ==========");
    }
}