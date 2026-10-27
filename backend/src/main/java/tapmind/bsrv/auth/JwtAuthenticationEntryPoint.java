package tapmind.bsrv.auth;
import java.io.IOException;
import java.io.Serializable;

import jakarta.servlet.http.HttpServletRequest;  // Updated import
import jakarta.servlet.http.HttpServletResponse;  // Updated import

import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.stereotype.Component;
import jakarta.servlet.ServletException;
@Component
public class JwtAuthenticationEntryPoint implements AuthenticationEntryPoint {

    

  @Override
    public void commence(HttpServletRequest request, HttpServletResponse response, AuthenticationException authException) throws IOException, ServletException {
        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        System.out.println("data"+authException.getStackTrace());
        System.out.println("Access Denied !! " + authException.getMessage());
    }
}
