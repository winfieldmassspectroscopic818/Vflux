`timescale 1ns / 1ps

module tb_traffic_fsm;
  reg clk = 1'b0;
  reg rst_n = 1'b0;
  reg sensor = 1'b0;
  wire red;
  wire yellow;
  wire green;

  traffic_fsm uut (
    .clk(clk),
    .rst_n(rst_n),
    .sensor(sensor),
    .red(red),
    .yellow(yellow),
    .green(green)
  );

  always #5 clk = ~clk;

  initial begin
    $dumpfile("output/simulation/dump.vcd");
    $dumpvars(0, tb_traffic_fsm);

    #20 rst_n = 1'b1;
    #40 sensor = 1'b1;
    #30 sensor = 1'b0;
    #200 sensor = 1'b1;
    #120 $finish;
  end
endmodule
