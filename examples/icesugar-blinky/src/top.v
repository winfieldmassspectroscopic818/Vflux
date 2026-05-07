// iCESugar LED blinky example for Vflux.
module top(
  input  wire clk,
  output reg  led1,
  output reg  led2,
  output reg  led3
);
  reg [23:0] counter = 24'd0;

  always @(posedge clk) begin
    counter <= counter + 1'b1;
    led1 <= counter[21];
    led2 <= counter[22];
    led3 <= counter[23];
  end
endmodule
