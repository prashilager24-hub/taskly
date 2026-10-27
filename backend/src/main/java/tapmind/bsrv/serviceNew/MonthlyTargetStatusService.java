package tapmind.bsrv.serviceNew;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import tapmind.bsrv.dto.*;
import tapmind.bsrv.model.*;
import tapmind.bsrv.repository.UserWorkDataRepository;

import java.util.List;
import java.time.LocalDate;
import java.util.ArrayList;

import tapmind.bsrv.repository.*;

import java.time.DayOfWeek;

@Service
public class MonthlyTargetStatusService {

    @Autowired
    private MonthlyDepartmentTargetsRepository monthlyTargetRepo;

    @Autowired
    private UserWorkDataRepository userWorkDataRepo;

    public List<MonthlyTargetStatusDTO> getTargetsForToday(Integer departmentId, LocalDate today) {

        List<MonthlyDepartmentTargets> targets = monthlyTargetRepo.findByDepartment(departmentId);

        List<MonthlyTargetStatusDTO> response = new ArrayList<>();

        for (MonthlyDepartmentTargets t : targets) {

            MonthlyTargetStatusDTO dto = new MonthlyTargetStatusDTO();
            dto.setTargetID(t.getTargetID());
            dto.setTargetName(t.getTargetName());
            dto.setDayOfMonth(t.getDayOfMonth());

            response.add(dto);
        }

        return response;
    }

    // Weekend correction function
    private LocalDate correctForWeekend(int dayOfMonth, int month, int year) {

        LocalDate date = LocalDate.of(year, month, dayOfMonth);

        DayOfWeek dow = date.getDayOfWeek();

        if (dow == DayOfWeek.SATURDAY) {
            return date.minusDays(1); // Friday
        } else if (dow == DayOfWeek.SUNDAY) {
            return date.minusDays(2); // Friday
        }

        return date;
    }

}
