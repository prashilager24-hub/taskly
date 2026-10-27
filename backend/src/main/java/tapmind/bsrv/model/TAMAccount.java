package tapmind.bsrv.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Getter
@Setter
@Entity
@Table(name = "tam_accounts")
public class TAMAccount {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "account_id")
    private Long accountId;

    @Column(name = "publisher_name", nullable = false)
    private String publisherName;

    @Enumerated(EnumType.STRING)
    @Column(name = "status")
    private TAMStatus status;

    @Column(name = "entry_date")
    private LocalDate entryDate;

    @Column(name = "live_date")
    private LocalDate liveDate;

    @Column(name = "created_by_user_id")
    private Integer createdByUserID;

    @Column(name = "updated_by_user_id")
    private Integer updatedByUserID;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}