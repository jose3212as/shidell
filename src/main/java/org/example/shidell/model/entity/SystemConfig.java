package org.example.shidell.model.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.LocalDateTime;

@Entity
@Table(name = "system_config")
public class SystemConfig {

    public static final Long SINGLETON_ID = 1L;
    public static final String DEFAULT_TAB_TITLE = "Shidell";

    @Id
    private Long id = SINGLETON_ID;

    @Column(name = "tab_title", nullable = false, length = 100)
    private String tabTitle = DEFAULT_TAB_TITLE;

    @Column(name = "icon_url", length = 512)
    private String iconUrl;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    public SystemConfig() {}

    public SystemConfig(Long id, String tabTitle, String iconUrl, LocalDateTime updatedAt) {
        this.id = id;
        this.tabTitle = tabTitle;
        this.iconUrl = iconUrl;
        this.updatedAt = updatedAt;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getTabTitle() {
        return tabTitle;
    }

    public void setTabTitle(String tabTitle) {
        this.tabTitle = tabTitle;
    }

    public String getIconUrl() {
        return iconUrl;
    }

    public void setIconUrl(String iconUrl) {
        this.iconUrl = iconUrl;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }
}
