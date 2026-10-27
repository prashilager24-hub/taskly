package tapmind.bsrv.repository;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import tapmind.bsrv.model.HrQuery;
import tapmind.bsrv.model.QueryMessage;

@Repository
public interface QueryMessageRepository extends JpaRepository<QueryMessage, Long> {

    List<QueryMessage> findByQueryIdOrderByCreatedAtAsc(String queryId);

    void deleteByQueryId(String queryId);
}
