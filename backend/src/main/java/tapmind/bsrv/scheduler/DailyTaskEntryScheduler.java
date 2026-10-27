package tapmind.bsrv.scheduler;

import tapmind.bsrv.serviceNew.TaskEntryAuditService;
import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class DailyTaskEntryScheduler {

    private final TaskEntryAuditService taskEntryAuditService;

    // Runs every day at 10 AM
    @Scheduled(cron = "0 0 10 * * ?", zone = "Asia/Kolkata")
    // @Scheduled(cron = "0 30 11 * * ?", zone = "Asia/Kolkata")
    // @Scheduled(cron = "0 */5 * * * ?")
    public void checkDailyTaskEntries() {

        System.out.println("Running Daily Task Entry Audit...");

        taskEntryAuditService.auditDepartmentTaskEntries();
    }
}