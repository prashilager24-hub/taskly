package tapmind.bsrv.repository;

import tapmind.bsrv.model.SalesCallRescheduleLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.Optional;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.repository.query.Param;
import java.util.List;
@Repository
public interface SalesCallRescheduleLogRepository extends JpaRepository<SalesCallRescheduleLog, Long> {
}
