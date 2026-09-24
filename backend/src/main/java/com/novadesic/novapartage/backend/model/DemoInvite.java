package com.novadesic.novapartage.backend.model;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "ddsshare_demo_invites")
public class DemoInvite extends PanacheEntityBase {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    @Column(name = "token_hash", nullable = false, unique = true, length = 64)
    public String tokenHash;

    @Column(name = "created_by_email", nullable = false)
    public String createdByEmail;

    @Column(name = "created_at")
    public LocalDateTime createdAt;

    @Column(name = "invite_expires_at", nullable = false)
    public LocalDateTime inviteExpiresAt;

    @Column(name = "consumed_at")
    public LocalDateTime consumedAt;

    @Column(name = "reserved_email")
    public String reservedEmail;

    @Column(name = "reserved_at")
    public LocalDateTime reservedAt;
}
