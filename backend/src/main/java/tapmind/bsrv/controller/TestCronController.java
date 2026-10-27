package tapmind.bsrv.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import tapmind.bsrv.serviceNew.TaskEntryAuditService;

@RestController
@RequiredArgsConstructor
public class TestCronController {

    private final TaskEntryAuditService taskEntryAuditService;

    @GetMapping("/test-task-mail")
    public String testTaskMail() {

        taskEntryAuditService.auditDepartmentTaskEntries();

        return "Task entry mail triggered";
    }
}