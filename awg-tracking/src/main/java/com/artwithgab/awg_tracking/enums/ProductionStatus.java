package com.artwithgab.awg_tracking.enums;

import com.fasterxml.jackson.annotation.JsonProperty;

public enum ProductionStatus {
    @JsonProperty("not_started") NOT_STARTED,
    @JsonProperty("in_progress") IN_PROGRESS,
    @JsonProperty("finished") FINISHED
}
