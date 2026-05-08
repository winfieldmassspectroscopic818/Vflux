// PWM breathing LED example for iCESugar.

module top (
  input  wire clk,
  output wire led1,
  output wire led2,
  output wire led3
);
  reg [7:0] pwm_counter = 8'd0;
  reg [7:0] duty = 8'd0;
  reg [15:0] ramp_divider = 16'd0;
  reg direction = 1'b0;
  reg [23:0] heartbeat = 24'd0;

  always @(posedge clk) begin
    pwm_counter <= pwm_counter + 8'd1;
    heartbeat <= heartbeat + 24'd1;

    ramp_divider <= ramp_divider + 16'd1;
    if (ramp_divider == 16'd0) begin
      if (!direction) begin
        duty <= duty + 8'd1;
        if (duty == 8'hfe) direction <= 1'b1;
      end else begin
        duty <= duty - 8'd1;
        if (duty == 8'h01) direction <= 1'b0;
      end
    end
  end

  assign led1 = pwm_counter < duty;
  assign led2 = heartbeat[22];
  assign led3 = direction;
endmodule
