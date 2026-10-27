package tapmind.bsrv.serviceNew;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.*;
import org.springframework.stereotype.Service;
import tapmind.bsrv.dto.*;
import tapmind.bsrv.model.*;
import tapmind.bsrv.repository.TAMAccountRepository;

import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class TAMAccountService {

    @Autowired
    private TAMAccountRepository repo;

    // CREATE
    public TAMResponse create(TAMCreateRequest req) {

        TAMAccount acc = new TAMAccount();

        acc.setPublisherName(req.getPublisherName());
        acc.setCreatedByUserID(req.getUserID());

        acc.setStatus(TAMStatus.NOT_LIVE);

        acc.setEntryDate(LocalDate.now());

        repo.save(acc);

        return mapToResponse(acc);
    }

    // UPDATE
    public TAMResponse update(TAMUpdateRequest req) {

        TAMAccount acc = repo.findById(req.getAccountId())
                .orElseThrow(() -> new RuntimeException("Account not found"));

        TAMStatus oldStatus = acc.getStatus();

        if (req.getPublisherName() != null) {
            acc.setPublisherName(req.getPublisherName());
        }

        if (req.getStatus() != null) {

            if (req.getStatus() == TAMStatus.LIVE &&
                    oldStatus != TAMStatus.LIVE) {

                acc.setLiveDate(LocalDate.now());
            }

            acc.setStatus(req.getStatus());
        }

        acc.setUpdatedByUserID(req.getUserID());

        repo.save(acc);

        return mapToResponse(acc);
    }

    // LIST USER RECORDS
    public List<TAMResponse> listAll(
            Integer userId,
            String statusFilter) {

        List<TAMAccount> accounts;

        if (statusFilter != null &&
                !statusFilter.equalsIgnoreCase("ALL")) {

            accounts = repo.findAllByCreatedByUserIDAndStatus(
                    userId,
                    TAMStatus.valueOf(statusFilter));

        } else {

            accounts = repo.findAllByCreatedByUserID(userId);
        }

        return accounts.stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    // PAGINATION
    public Map<String, Object> listAll(
            int page,
            int size,
            String sortBy,
            String sortDirection,
            String statusFilter) {

        Sort sort = sortDirection.equalsIgnoreCase("DESC")
                ? Sort.by(sortBy).descending()
                : Sort.by(sortBy).ascending();

        Pageable pageable = PageRequest.of(page - 1, size, sort);

        Page<TAMAccount> result;

        if (statusFilter != null &&
                !statusFilter.equalsIgnoreCase("ALL")) {

            result = repo.findAllByStatus(
                    TAMStatus.valueOf(statusFilter),
                    pageable);

        } else {

            result = repo.findAll(pageable);
        }

        Map<String, Object> response = new HashMap<>();

        response.put(
                "data",
                result.getContent()
                        .stream()
                        .map(this::mapToResponse)
                        .collect(Collectors.toList()));

        response.put("currentPage", page);
        response.put("totalItems", result.getTotalElements());
        response.put("totalPages", result.getTotalPages());

        return response;
    }

    private TAMResponse mapToResponse(TAMAccount acc) {

        TAMResponse res = new TAMResponse();

        res.setAccountId(acc.getAccountId());
        res.setPublisherName(acc.getPublisherName());
        res.setStatus(acc.getStatus());

        res.setEntryDate(
                acc.getEntryDate() != null
                        ? acc.getEntryDate().toString()
                        : null);

        res.setLiveDate(
                acc.getLiveDate() != null
                        ? acc.getLiveDate().toString()
                        : null);

        res.setCreatedByUserID(acc.getCreatedByUserID());
        res.setUpdatedByUserID(acc.getUpdatedByUserID());

        res.setCreatedAt(
                acc.getCreatedAt() != null
                        ? acc.getCreatedAt().toString()
                        : null);

        res.setUpdatedAt(
                acc.getUpdatedAt() != null
                        ? acc.getUpdatedAt().toString()
                        : null);

        return res;
    }
}