package tapmind.bsrv.controller;

import org.springframework.beans.factory.annotation.Autowired;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.json.JSONObject;

import tapmind.bsrv.dto.jwt.JwtRequest;
import tapmind.bsrv.dto.jwt.JwtResponse;

import java.util.List;

import org.joda.time.format.DateTimeFormat;
import org.joda.time.format.DateTimeFormatter;
import org.json.JSONException;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.*;
import org.springframework.context.annotation.Lazy;

import tapmind.bsrv.serviceNew.JwtUserService;
import jakarta.validation.Valid;
import tapmind.bsrv.dto.jwt.UserSwitchRequestDTO;
import tapmind.bsrv.dto.*;

@RestController
@CrossOrigin
public class JwtAuthController {

    @Lazy
    @Autowired
    private JwtUserService userDetailsService;

    @RequestMapping(value = "/t2.0/authentificationUtilization/authenticate", method = RequestMethod.POST)
    public ResponseEntity<String> createAuthenticationToken(@RequestBody JwtRequest authenticationRequest)
            throws Exception {
        String name = authenticationRequest.getUsername();
        String date = userDetailsService.findExpireDate(name);
        JSONObject jsonObject = userDetailsService.authenticationLog(date, name, authenticationRequest);
        return ResponseEntity.ok(jsonObject.toString());
    }

    @PostMapping("/t2.0/authentificationUtilization/User/create")
    public ResponseEntity<UserResponseDTO> createUser(
            @Valid @RequestBody UserCreateDTO requestDTO) {
        UserResponseDTO response = new UserResponseDTO();
        try {
            UserResponseDTO createdUser = userDetailsService.createUser(requestDTO);
            return new ResponseEntity<>(createdUser, HttpStatus.CREATED);
        } catch (Exception e) {
            e.printStackTrace();
            response.setStatus(false);
            response.setMessage(e.getMessage());
            return new ResponseEntity<>(response, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @PutMapping("/t2.0/authentificationUtilization/User/update")
    public ResponseEntity<UserResponseDTO> updateUser(
            @Valid @RequestBody UserCreateDTO requestDTO) {
        UserResponseDTO response = new UserResponseDTO();
        try {
            UserResponseDTO createdUser = userDetailsService.updateUser(requestDTO);
            return new ResponseEntity<>(createdUser, HttpStatus.CREATED);
        } catch (Exception e) {
            e.printStackTrace();
            response.setStatus(false);
            response.setMessage(e.getMessage());
            return new ResponseEntity<>(response, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @GetMapping("/t2.0/authentificationUtilization/MissingData")
    public List<MissingWorkDataUserDTO> getMissingUsers(
            @RequestParam("startDate") String startDate,
            @RequestParam("endDate") String endDate) {

        DateTimeFormatter formatter = DateTimeFormat.forPattern("yyyy-MM-dd");

        org.joda.time.LocalDate jodaStart = formatter.parseLocalDate(startDate);
        org.joda.time.LocalDate jodaEnd = formatter.parseLocalDate(endDate);

        java.time.LocalDate start = java.time.LocalDate.parse(jodaStart.toString());
        java.time.LocalDate end = java.time.LocalDate.parse(jodaEnd.toString());

        return userDetailsService.getUsersWhoDidNotFillData(start, end);

    }

    @PostMapping(path = "/t2.0/authentificationUtilization/users/read", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> getUsers(@RequestBody @Valid UserReadDTO userReadDTO,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "userModifyTime") String sortBy) throws JSONException {
        try {
            UserListResponseDTO response = userDetailsService.getUsers(userReadDTO, page, size, sortBy);
            return new ResponseEntity<>(response, new HttpHeaders(), HttpStatus.OK);
        } catch (Exception e) {
            e.printStackTrace();
            return new ResponseEntity<>(e.getMessage(), new HttpHeaders(), HttpStatus.OK);

        }
    }

    @PostMapping("/t2.0/authentificationUtilization/updateUserStatus")
    public ResponseEntity<UserResponseDTO> updateStatus(@RequestBody UserStatusUpdateDTO request) {
        UserResponseDTO response = userDetailsService.updateUserStatus(request);
        return new ResponseEntity<>(response, HttpStatus.valueOf(response.getStatusCode()));
    }

    @RequestMapping(value = "/t2.0/authentificationUtilization/usersArchive", method = RequestMethod.POST)
    public ResponseEntity<UserResponseDTO> archiveUsers(@RequestBody ArchiveUserRequestDTO requestDTO) {
        UserResponseDTO response = userDetailsService.archiveUsers(requestDTO);
        return new ResponseEntity<>(response, HttpStatus.valueOf(response.getStatusCode()));
    }

    @RequestMapping(value = "/t2.0/authentificationUtilization/forgotPassword", method = RequestMethod.POST)
    public @ResponseBody String forgotPassword(@RequestBody String emailJson) {
        JSONObject jsonResponse = userDetailsService.handleForgotPassword(emailJson);
        return jsonResponse.toString();
    }

    @RequestMapping(value = "/t2.0/authentificationUtilization/resetPassword", method = RequestMethod.POST)
    public @ResponseBody String resetPassword(HttpServletRequest httpRequest, HttpServletResponse httpResponse,
            @RequestBody String data) throws Exception {
        httpResponse.setHeader("Content-Type", "application/json");
        return userDetailsService.resetPassword(data).toString();
    }

    @RequestMapping(value = { "/t2.0/authentificationUtilization/sendMailbulk" }, method = RequestMethod.POST)
    public ResponseEntity<String> sendMailsbulk() {
        try {
            userDetailsService.sendMail(); // Calls your existing sendMail() logic
            return ResponseEntity.ok("Emails sent successfully!");
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(500).body("Failed to send emails: " + e.getMessage());
        }
    }

    @PostMapping("/t2.0/authentificationUtilization/user/switch")
    public ResponseEntity<String> switchUser(
            @RequestBody UserSwitchRequestDTO request,
            HttpServletRequest httpRequest) throws Exception {

        JSONObject response = userDetailsService.switchUser(request, httpRequest);

        return ResponseEntity.ok(response.toString());
    }
}