module counter(
  input  wire clk,
  input  wire rst_n,
  output reg [7:0] value
);
  always @(posedge clk or negedge rst_n) begin
    if (!rst_n) value <= 8'd0;
    else value <= value + 8'd1;
  end
endmodule
