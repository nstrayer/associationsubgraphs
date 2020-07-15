library(dplyr)
test_that("Gathering average strengths", {
  association_pairs <- tibble(
    a = c("a", "a", "a", "a", "a", "b", "b", "b", "b", "c", "c", "c", "d", "d", "e"),
    b = c("b", "c", "d", "e", "f", "c", "d", "e", "f", "d", "e", "f", "e", "f", "f"),
    w = c( 15,  13,   9,   8,   7,  12,   6,   5,  11,   4,   3,  11,  14,   2,  10)
  )
  avg_strengths <- gather_avg_strength(association_pairs, strength_column = "w")

  expect_equal(
    arrange(avg_strengths, id)$avg_strength,
    c(52, 49, 43, 35, 40, 41)/5
  )

})
