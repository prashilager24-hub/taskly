package tapmind.bsrv.repository;

import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import tapmind.bsrv.model.TAMAccount;
import tapmind.bsrv.model.TAMStatus;

@Repository
public interface TAMAccountRepository extends JpaRepository<TAMAccount, Long> {

        List<TAMAccount> findAllByCreatedByUserID(Integer userId);

        @Query("SELECT t FROM TAMAccount t WHERE t.createdByUserID = :userId AND t.status = :status")
        List<TAMAccount> findAllByCreatedByUserIDAndStatus(
                        @Param("userId") Integer userId,
                        @Param("status") TAMStatus status);

        Page<TAMAccount> findAllByStatus(
                        TAMStatus status,
                        Pageable pageable);

        List<TAMAccount> findByStatusAndLiveDateIsNotNull(
                        TAMStatus status);
}