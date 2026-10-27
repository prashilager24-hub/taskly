package tapmind.bsrv.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import tapmind.bsrv.model.JobPosition;
import tapmind.bsrv.model.PositionStatus;
import java.util.List;

public interface JobPositionRepository extends JpaRepository<JobPosition, Long> {

    List<JobPosition> findByStatusAndCloseDateIsNotNull(PositionStatus status);

    List<JobPosition> findAllByCreatedByUserID(Integer userId);

    List<JobPosition> findAllByCreatedByUserIDAndStatus(Integer userId, PositionStatus status);

    Page<JobPosition> findAllByStatus(PositionStatus status, Pageable pageable);
}