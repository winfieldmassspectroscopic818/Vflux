`include "src/vflux_defs.vh"

module led_chaser (
  input wire clk,
  input wire tick,
  output reg [`VFLUX_LED_COUNT-1:0] led = 3'b001
);
  always @(posedge clk) begin
    if (tick) begin
      led <= {led[`VFLUX_LED_COUNT-2:0], led[`VFLUX_LED_COUNT-1]};
    end
  end
endmodule
