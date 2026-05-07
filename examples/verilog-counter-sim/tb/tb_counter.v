`timescale 1ns / 1ps

module tb_counter;
  reg clk = 1'b0;
  reg rst_n = 1'b0;
  wire [7:0] value;

  counter uut (
    .clk(clk),
    .rst_n(rst_n),
    .value(value)
  );

  always #5 clk = ~clk;

  initial begin
    $dumpfile("output/simulation/dump.vcd");
    $dumpvars(0, tb_counter);
    #20 rst_n = 1'b1;
    #300 $finish;
  end
endmodule
