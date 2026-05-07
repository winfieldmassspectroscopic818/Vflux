// iCESugar-pro ECP5 LED blinky example for Vflux.
module top(
  input  wire clk,
  output reg  led
);
  reg [24:0] counter = 25'd0;

  always @(posedge clk) begin
    counter <= counter + 1'b1;
    led <= counter[24];
  end
endmodule
