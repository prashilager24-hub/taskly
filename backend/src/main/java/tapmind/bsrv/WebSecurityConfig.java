package tapmind.bsrv;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.builders.AuthenticationManagerBuilder;
import org.springframework.security.config.annotation.method.configuration.EnableGlobalMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.config.http.SessionCreationPolicy;

import tapmind.bsrv.auth.JwtAuthenticationEntryPoint;
import tapmind.bsrv.filter.JwtAuthenticationFilter;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.context.annotation.Lazy;

@Configuration
@EnableWebSecurity
public class WebSecurityConfig {

    @Autowired
    private JwtAuthenticationEntryPoint jwtAuthenticationEntryPoint;


    @Lazy
    @Autowired
    private UserDetailsService jwtUserDetailsService;

    @Lazy
    @Autowired
    private JwtAuthenticationFilter jwtRequestFilter;



	

    @SuppressWarnings("removal")
    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        // We don't need CSRF for this example

        
        http.csrf().disable()
            //      .oauth2Login(oauth2 -> oauth2
            //     .successHandler(OAuth2LoginSuccessHandler())
            // )
                // Don't authenticate these particular requests
                .authorizeRequests()
                .requestMatchers("/t2.0/authentificationUtilization/authenticate",
                "/t2.0/authentificationUtilization/**", "/health")
                .permitAll()
                // All other requests need to be authenticated
                .anyRequest().authenticated()
                .and()
                .exceptionHandling().authenticationEntryPoint(jwtAuthenticationEntryPoint)
                .and()
                .sessionManagement()
                .sessionCreationPolicy(SessionCreationPolicy.STATELESS);  // Ensure stateless session

        // Add filter to validate the token with every request
        http.addFilterBefore(jwtRequestFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }
}
