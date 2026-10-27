package tapmind.bsrv.repository;

import tapmind.bsrv.model.MonthlyDepartmentTargets;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.Optional;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.repository.query.Param;
import java.util.List;
@Repository
public interface MonthlyDepartmentTargetsRepository extends JpaRepository<MonthlyDepartmentTargets, Integer> {

    @Query("SELECT m FROM MonthlyDepartmentTargets m WHERE m.departmentID = :deptId ORDER BY m.dayOfMonth")
    List<MonthlyDepartmentTargets> findByDepartment(@Param("deptId") Integer departmentId);
}
