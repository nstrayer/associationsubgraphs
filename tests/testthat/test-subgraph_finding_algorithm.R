library(dplyr)
test_that("multiplication works", {

  # Bespoke artisinal association pairs chosen for properties
  association_pairs <- tibble(
    a = c("a", "a", "a", "a", "a", "b", "b", "b", "b", "c", "c", "c", "d", "d", "e"),
    b = c("b", "c", "d", "e", "f", "c", "d", "e", "f", "d", "e", "f", "e", "f", "f"),
    w = c( 15,  13,   9,   8,   7,  12,   6,   5,  11,   4,   3,  11,  14,   2,  10)
  )

  results <- calculate_subgraph_structure(association_pairs, strength_column = "w")

  first_7_steps <- head(results, 7)
  remaining_steps <- tail(results, nrow(results) - 7)

  # Strengths go in decending order as we'd hope
  expect_equal(
    15:2,
    results$strength
  )

  # Catches our double of strength 11
  expect_equal(
    c(1, 2, 3, 4, 6, 7, 8),
    first_7_steps$n_edges
  )
  expect_equal(
    9:15,
    remaining_steps$n_edges
  )


  # Counts the number of subgraphs properly
  expect_equal(
    c(1,2,2,2,2,1,1),
    first_7_steps$n_subgraphs
  )
  expect_equal(
    rep(1, 7),
    remaining_steps$n_subgraphs
  )

  # Keeps track of the largest sized component properly
  largest_subgraph <- c(2,2,3,3,4,6,6)
  expect_equal(
    largest_subgraph,
    first_7_steps$max_size
  )
  expect_equal(
    rep(6, 7),
    remaining_steps$max_size
  )

  total_nodes_seen <- c(2,4,5,5,6,6,6)
  expect_equal(
    total_nodes_seen,
    first_7_steps$n_nodes_seen
  )
  expect_equal(
    rep(6, 7),
    remaining_steps$n_nodes_seen
  )

  expect_equal(
    largest_subgraph/total_nodes_seen,
    first_7_steps$rel_max_size
  )
  expect_equal(
    rep(1, 7),
    remaining_steps$rel_max_size
  )

  expect_equal(
    c(1,1,(2/3 + 1)/2, 1, (5/6 + 1)/2, 7/15, 8/15),
    first_7_steps$avg_density
  )
  expect_equal(
    9:15/15,
    remaining_steps$avg_density
  )

  expect_equal(
    c(2, 2, (3 + 2)/2, (3 + 2)/2, (4 + 2)/2, 6, 6),
    first_7_steps$avg_size
  )
  expect_equal(
    rep(6, 7),
    remaining_steps$avg_size
  )

  expect_equal(
    c(0,0,1,1,1,1,1),
    first_7_steps$n_triples
  )
  expect_equal(
    rep(1, 7),
    remaining_steps$n_triples
  )

  # Now we test the subgraph list results
  subgraphs_for_1 <- results$subgraphs[[1]]
  expect_equal(
    subgraphs_for_1$size,
    2
  )
  expect_equal(
    subgraphs_for_1$density,
    1
  )
  expect_equal(
    subgraphs_for_1$strength,
    15
  )

  subgraphs_for_2 <- results$subgraphs[[2]]
  expect_equal(
    subgraphs_for_2$size,
    c(2,2)
  )
  expect_equal(
    subgraphs_for_2$density,
    c(1,1)
  )
  expect_equal(
    subgraphs_for_2$strength,
    c(15,14)
  )

  subgraphs_for_3 <- results$subgraphs[[3]]
  expect_equal(
    subgraphs_for_3$size,
    c(3,2)
  )
  expect_equal(
    subgraphs_for_3$density,
    c(2/3,1)
  )
  expect_equal(
    subgraphs_for_3$strength,
    c((15+13)/2,14)
  )

  # Skipping a step
  subgraphs_for_5 <- results$subgraphs[[5]]
  expect_equal(
    subgraphs_for_5$size,
    c(4,2)
  )
  expect_equal(
    subgraphs_for_5$density,
    c(5/6,1)
  )
  expect_equal(
    subgraphs_for_5$strength,
    c((15+13+12+11+11)/5,14)
  )




})
