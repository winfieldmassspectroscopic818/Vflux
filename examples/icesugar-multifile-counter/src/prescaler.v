`include "src/vflux_defs.vh"

module prescaler (
  input wire clk,
  output wire tick
);
  reg [`VFLUX_COUNTER_WIDTH-1:0] counter = 0;

  always @(posedge clk) begin
    counter <= counter + 1'b1;
  end

  assign tick = &counter;
endmodule
