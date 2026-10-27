package tapmind.bsrv.repository;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import tapmind.bsrv.model.Admin;
import tapmind.bsrv.model.PositionStatus;

public interface AdminRepository extends JpaRepository<Admin, Long> {
  List<Admin> findByStatusAndCloseDateIsNotNull(PositionStatus status);

  List<Admin> findAllByCreatedByUserID(Integer userId);
}
