package com.novadesic.novapartage.backend.model;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.LocalDateTime;

@Entity
@Table(name = "ddsshare_demo_entitlements")
public class DemoEntitlement extends PanacheEntityBase {

    @Id
    @Column(name = "email")
    public String email;

    @Column(name = "valid_until", nullable = false)
    public LocalDateTime validUntil;

    @Column(name = "invite_id")
    public Long inviteId;

    @Column(name = "created_at")
    public LocalDateTime createdAt;
}
