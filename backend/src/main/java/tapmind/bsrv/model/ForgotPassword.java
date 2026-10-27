package tapmind.bsrv.model;

import jakarta.persistence.*;
import java.io.Serializable;
import java.util.*;
@Entity
@Table(name = "ForgotPassword")
public class ForgotPassword implements Serializable {

  

    @Id
    @Column(name = "uuid")
    private String uuid;

    @Column(name = "user_id")
    private int userId;

    @Temporal(value = TemporalType.TIMESTAMP)
    @Column(name = "start_time")
    private Date startTime;

   	@Temporal(value = TemporalType.TIMESTAMP)
    @Column(name = "end_time")
    private Date endTime;

    @Column(name = "status")
    private boolean status;

    // Getters and Setters

    public String getUuid() {
        return uuid;
    }

    public void setUuid(String uuid) {
        this.uuid = uuid;
    }

    public int getUserId() {
        return userId;
    }

    public void setUserId(int userId) {
        this.userId = userId;
    }

    public Date getStartTime() {
        return startTime;
    }

    public void setStartTime(Date startTime) {
        this.startTime = startTime;
    }

    public Date getEndTime() {
        return endTime;
    }

    public void setEndTime(Date endTime) {
        this.endTime = endTime;
    }

    public boolean isStatus() {
        return status;
    }

    public void setStatus(boolean status) {
        this.status = status;
    }
}
