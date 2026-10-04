package com.artwithgab.awg_tracking.service.util;

import com.artwithgab.awg_tracking.exception.OrderCodeAlreadyExistException;
import com.artwithgab.awg_tracking.repository.OrderRepository;
import lombok.AllArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;

@Service
@AllArgsConstructor
public class OrderCodeGeneratorService {

    private final OrderRepository orderRepository;


    private boolean checkIfCodeExist(String code) {
        return orderRepository.existsByCode(code);
    }


    public String generateCode() {
        String code;
        do {
            int randomNumber = ThreadLocalRandom.current().nextInt(1000, 10000);
            code = "AWG" + randomNumber;
        } while (checkIfCodeExist(code));

        return code;
    }

    public String generateFormToken() {
        return UUID.randomUUID().toString();
    }
}
