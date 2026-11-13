package com.artwithgab.awg_tracking.enums;

import com.fasterxml.jackson.annotation.JsonProperty;

/** Surface of the raw ornament. Stock is tracked per color and finish. */
public enum CustomFinish {
    @JsonProperty("shiny") SHINY,
    @JsonProperty("matte") MATTE
}
