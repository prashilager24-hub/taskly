// package tapmind.bsrv.serviceNew;

// import org.springframework.stereotype.Service;
// import org.springframework.beans.factory.annotation.Autowired;
// import java.util.List;

// // 🔥 THESE ARE MISSING (your main issue)
// import tapmind.bsrv.dto.PmsGoalsDTO;
// import tapmind.bsrv.model.PmsGoals;
// import tapmind.bsrv.repository.PmsGoalsRepository;

// @Service
// public class PmsGoalsService {

// @Autowired
// private PmsGoalsRepository repository;

// // ✅ Save multiple goals (from modal)
// public List<PmsGoals> saveGoals(List<PmsGoalsDTO> dtos) {
// List<PmsGoals> goals = dtos
// .stream()
// .map(dto -> {
// PmsGoals g = new PmsGoals();
// g.setUserID(dto.getUserID());
// g.setDepartmentID(dto.getDepartmentID());
// g.setGoalID(dto.getGoalID());
// g.setQuarter(dto.getQuarter());
// g.setGoalYear(dto.getGoalYear());
// g.setGoalTitle(dto.getGoalTitle());
// g.setDescription(dto.getDescription());
// g.setWeight(dto.getWeight());
// g.setCategory(dto.getCategory());

// if (dto.getStatus() != null) {
// g.setStatus(PmsGoals.Status.valueOf(dto.getStatus()));
// }

// return g;
// })
// .toList();

// return repository.saveAll(goals);
// }

// // ✅ Fetch goals
// public List<PmsGoals> getGoals(Integer userId, String quarter, Integer year)
// {
// return repository.findByUserIDAndQuarterAndGoalYear(userId, quarter, year);
// }
// }
