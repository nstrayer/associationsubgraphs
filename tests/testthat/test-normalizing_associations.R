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


test_that("Relative associations transformation", {
  association_pairs <-
    dplyr::tibble(
             a = c("A", "A", "A", "B", "B", "C"),
             b = c("B", "C", "D", "C", "D", "D"),
      strength = c(  3,   6,   9,  12,  15,  18)
    )

  expect_equivalent(
    build_relative_associations(association_pairs, impute_missing = "minimum"),
    dplyr::tibble(
      a = c("A", "A", "A", "B", "B", "C"),
      b = c("B", "C", "D", "C", "D", "D"),
      strength = c(3/8, 6/9, 9/10, 12/11, 15/12, 18/13)
    ) %>% arrange(-strength)
  )

})

test_that("Getting relative associations handles missing values", {
  association_pairs <-
    dplyr::tibble(
      a = c("A", "A", "B", "B", "C"),
      b = c("B", "C", "C", "D", "D"),
      strength = c(  3,   6,  12,  15,  18)
    )

  expect_warning(
    build_relative_associations(association_pairs),
    paste("There are missing association pairs. Defaulting to minimum imputation.",
          "Run ?build_relative_associations and see section ",
          "\"missing association pairs\" for more information."),
    fixed = TRUE
  )


  expect_equivalent(
    build_relative_associations(association_pairs, impute_missing = "minimum"),
    dplyr::tibble(
             a = c("A", "A", "A", "B", "B", "C"),
             b = c("B", "C", "D", "C", "D", "D"),
      strength = c(  3/7,   6/8,   3/8,  12/11,  15/11,  18/12)
    ) %>% arrange(-strength)
  )

  expect_equivalent(
    build_relative_associations(association_pairs, impute_missing = "minimum", return_imputed_pairs = FALSE),
    dplyr::tibble(
      a = c("A", "A","B", "B", "C"),
      b = c("B", "C","C", "D", "D"),
      strength = c(  3/7,   6/8,   12/11,  15/11,  18/12)
    ) %>% arrange(-strength)
  )

  expect_equivalent(
    build_relative_associations(association_pairs, impute_missing = "ignore"),
    dplyr::tibble(
      a = c("A", "A", "B", "B", "C"),
      b = c("B", "C", "C", "D", "D"),
      strength = c(  6/(9/2 + 10),   12/(9/2 + 12), 24/22,  30/(10 + 33/2),  36/(12 + 33/2))
    ) %>% arrange(-strength)
  )

})

