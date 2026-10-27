package tapmind.bsrv.service;

import java.util.List;

import tapmind.bsrv.dto.MonthlyReviewRequestDTO;
import tapmind.bsrv.dto.MonthlyReviewResponseDTO;

public interface MonthlyReviewService {

    MonthlyReviewResponseDTO create(MonthlyReviewRequestDTO requestDTO);

    List<MonthlyReviewResponseDTO> getByEmpIdAndYear(
            Integer empId,
            String year);

    void delete(Integer id);
}