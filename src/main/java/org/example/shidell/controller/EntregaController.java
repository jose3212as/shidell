package org.example.shidell.controller;

import org.example.shidell.model.entity.Entrega;
import org.example.shidell.model.dto.EntregaDTO;
import org.example.shidell.service.EntregaService;
import org.example.shidell.mapper.EntityMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/entregas")
@CrossOrigin(origins = "*")
public class EntregaController {

    @Autowired
    private EntregaService entregaService;

    @Autowired
    private EntityMapper mapper;

    @PostMapping(consumes = "multipart/form-data")
    public ResponseEntity<?> subirEntrega(@RequestParam Long tareaId,
                                          @RequestParam Long estudianteId,
                                          @RequestParam(required = false) String comentario,
                                          @RequestParam(value = "archivo", required = false) MultipartFile archivo) {
        if (archivo == null || archivo.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Selecciona un archivo PDF, DOC o DOCX para entregar la tarea."));
        }
        Entrega saved = entregaService.subirEntrega(tareaId, estudianteId, comentario, archivo);
        return ResponseEntity.ok(mapper.toDTO(saved));
    }

    @GetMapping("/tarea/{tareaId}")
    public List<EntregaDTO> getEntregasPorTarea(@PathVariable Long tareaId) {
        return entregaService.obtenerEntregasPorTarea(tareaId).stream().map(mapper::toDTO).toList();
    }

    @GetMapping("/usuario/{estudianteId}")
    public List<EntregaDTO> getEntregasByEstudiante(@PathVariable Long estudianteId) {
        return entregaService.obtenerEntregasPorEstudiante(estudianteId).stream().map(mapper::toDTO).toList();
    }

    @PutMapping("/{entregaId}/calificar")
    public EntregaDTO calificarEntrega(@PathVariable Long entregaId,
                                    @RequestParam Double nota,
                                    @RequestParam(required = false) String comentario) {
        return mapper.toDTO(entregaService.calificarEntrega(entregaId, nota, comentario));
    }
}
