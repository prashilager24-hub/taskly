package tapmind.bsrv.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import tapmind.bsrv.model.GoalEfficiency;

public interface GoalEfficiencyRepository
        extends JpaRepository<GoalEfficiency, Integer> {
}
