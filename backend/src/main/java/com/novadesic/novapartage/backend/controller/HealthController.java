package com.novadesic.novapartage.backend.controller;

import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.jboss.logging.Logger;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

@Path("/api/health")
public class HealthController {
    
    private static final Logger LOG = Logger.getLogger(HealthController.class);
    
    @GET
    @Produces(MediaType.APPLICATION_JSON)
    public Response health() {
        try {
            Map<String, Object> health = new HashMap<>();
            health.put("status", "healthy");
            health.put("service", "novapartage-backend");
            health.put("timestamp", LocalDateTime.now().toString());
            health.put("version", "1.0.0-SNAPSHOT");
            
            LOG.infof("Health check requested - service is healthy");
            
            return Response.ok(health).build();
            
        } catch (Exception e) {
            LOG.errorf(e, "Health check failed");
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                          .entity(Map.of("status", "unhealthy", "error", e.getMessage()))
                          .build();
        }
    }
}
