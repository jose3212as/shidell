package org.example.shidell.config;

import com.github.benmanes.caffeine.cache.Caffeine;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.cache.caffeine.CaffeineCache;
import org.springframework.cache.support.SimpleCacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.filter.ShallowEtagHeaderFilter;

import java.util.List;
import java.util.concurrent.TimeUnit;

/**
 * Caché en RAM con Caffeine y ETags HTTP para acelerar respuestas frecuentes sin perder frescura.
 */
@Configuration
@EnableCaching
public class CacheConfig {

    @Bean
    public CacheManager cacheManager() {
        SimpleCacheManager manager = new SimpleCacheManager();
        manager.setCaches(List.of(
                buildCache("systemConfig", 10, 5, TimeUnit.MINUTES),
                buildCache("faviconPayload", 10, 5, TimeUnit.MINUTES),
                buildCache("adminStats", 10, 20, TimeUnit.SECONDS),
                buildCache("cursosCatalogo", 32, 30, TimeUnit.SECONDS),
                buildCache("calendarioMinedu", 64, 30, TimeUnit.MINUTES)
        ));
        return manager;
    }

    private CaffeineCache buildCache(String name, long maxSize, long duration, TimeUnit unit) {
        return new CaffeineCache(name, Caffeine.newBuilder()
                .maximumSize(maxSize)
                .expireAfterWrite(duration, unit)
                .build());
    }

    @Bean
    public FilterRegistrationBean<ShallowEtagHeaderFilter> shallowEtagHeaderFilter() {
        FilterRegistrationBean<ShallowEtagHeaderFilter> registration =
                new FilterRegistrationBean<>(new ShallowEtagHeaderFilter());
        registration.addUrlPatterns(
                "/api/config",
                "/api/cursos",
                "/api/admin/stats",
                "/vendor/*",
                "/assets/*",
                "/favicon.ico"
        );
        registration.setName("shidellEtagFilter");
        return registration;
    }
}
