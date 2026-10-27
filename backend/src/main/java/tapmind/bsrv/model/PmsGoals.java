// package tapmind.bsrv.model;

// import javax.persistence.Entity;
// import javax.persistence.Table;
// import javax.persistence.Id;
// import javax.persistence.GeneratedValue;
// import javax.persistence.GenerationType;
// import javax.persistence.Enumerated;
// import javax.persistence.EnumType;
// import java.time.LocalDateTime;

// @Entity
// @Table(name = "PmsGoals")
// public class PmsGoals {

// @Id
// @GeneratedValue(strategy = GenerationType.IDENTITY)
// private Integer id;

// private Integer userID;
// private Integer departmentID;
// private Integer goalID;

// private String quarter;
// private Integer goalYear;

// private String goalTitle;
// private String description;
// private Integer weight;
// private String category;

// @Enumerated(EnumType.STRING)
// private Status status = Status.Pending;

// private LocalDateTime createdAt;
// private LocalDateTime updatedAt;

// public enum Status {
// Pending, Acknowledged
// }

// // getters & setters
// }