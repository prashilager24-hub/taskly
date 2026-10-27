package tapmind.bsrv.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;
import tapmind.bsrv.dto.*;
import tapmind.bsrv.serviceNew.TAMAccountService;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/t2.0/authentificationUtilization/tam")
@CrossOrigin("*")
public class TAMAccountController {

    @Autowired
    private TAMAccountService service;

    @PostMapping("/create")
    public TAMResponse create(@RequestBody TAMCreateRequest req) {
        return service.create(req);
    }

    @PutMapping("/update")
    public TAMResponse update(@RequestBody TAMUpdateRequest req) {
        return service.update(req);
    }

    @GetMapping("/list")
    public Map<String, Object> list(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "accountId") String sortBy,
            @RequestParam(defaultValue = "DESC") String sortDirection,
            @RequestParam(defaultValue = "ALL") String status) {

        return service.listAll(
                page,
                size,
                sortBy,
                sortDirection,
                status);
    }
}