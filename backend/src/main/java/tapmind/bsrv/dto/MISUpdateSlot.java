package tapmind.bsrv.dto;

import lombok.Data;

import java.time.LocalTime;

@Data
public class MISUpdateSlot {

    private LocalTime expectedTime;
    private LocalTime actualTime;
}