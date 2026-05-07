`include "src/vflux_defs.vh"

module top (
  input wire clk,
  output wire led1,
  output wire led2,
  output wire led3
);
  wire tick;
  wire [`VFLUX_LED_COUNT-1:0] led_bus;

  prescaler u_prescaler (
    .clk(clk),
    .tick(tick)
  );

  led_chaser u_led_chaser (
    .clk(clk),
    .tick(tick),
    .led(led_bus)
  );

  assign {led3, led2, led1} = led_bus;
endmodule
