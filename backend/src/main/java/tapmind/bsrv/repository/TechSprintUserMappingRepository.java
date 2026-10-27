package tapmind.bsrv.repository;

import tapmind.bsrv.model.*;
import org.springframework.data.jpa.repository.*;
import java.time.LocalDateTime;
import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Sort;
import org.springframework.data.domain.Pageable;
import org.springframework.data.repository.query.Param;
public interface TechSprintUserMappingRepository
        extends JpaRepository<TechSprintUserMapping, Long> {

   

    @Query("""
    SELECT t
    FROM TechSprintUserMapping t
    WHERE t.sprint.sprintID = :sprintId
""")
List<TechSprintUserMapping> findBySprintID(
        @Param("sprintId") Long sprintId
);

}
