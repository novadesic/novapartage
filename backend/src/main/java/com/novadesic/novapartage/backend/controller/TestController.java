package com.novadesic.novapartage.backend.controller;

import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.jboss.logging.Logger;

@Path("/test")
@Produces(MediaType.APPLICATION_JSON)
public class TestController {
    
    private static final Logger LOG = Logger.getLogger(TestController.class);
    
    @GET
    @Path("/public")
    public Response testPublic() {
        LOG.info("Test endpoint public appelé");
        return Response.ok("{\"message\": \"Endpoint public accessible\"}").build();
    }
    
    @GET
    @Path("/health")
    public Response health() {
        return Response.ok("{\"status\": \"OK\"}").build();
    }
}
