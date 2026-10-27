package tapmind.bsrv.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import tapmind.bsrv.model.PrimaryDepartment;

import java.util.List;
import java.util.Optional;

public interface PrimaryDepartmentRepository extends JpaRepository<PrimaryDepartment, Long> {

    Optional<PrimaryDepartment> findByPrimaryDepartmentName(String primaryDepartmentName);

    List<PrimaryDepartment> findByIsActiveTrueOrderByPrimaryDepartmentNameAsc();
}
