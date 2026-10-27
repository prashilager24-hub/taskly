package tapmind.bsrv.auth;
import org.springframework.context.annotation.Bean;
import org.springframework.stereotype.Component;
@Component
public class TokenUtilsBean {

  @Bean
  public JwtTokenUtil tokenUtils() {
    return new JwtTokenUtil();
  }
}