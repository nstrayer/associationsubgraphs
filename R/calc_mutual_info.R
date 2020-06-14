
calc_mutual_info <- function(a_vec, b_vec, N){

  ab_tab <- table(a_vec, b_vec)

  P_A <- sum(ab_tab[2,])/N
  P_B <- sum(ab_tab[,2])/N
  P_notA <- 1 - P_A
  P_notB <- 1 - P_B
  P_notA_notB <- ab_tab[1,1]/N
  P_notA_B <- ab_tab[1,2]/N
  P_A_notB <- ab_tab[2,1]/N
  P_A_B <- ab_tab[2,2]/N

  ent_A <- -(P_A*e_log(P_A) +
               P_notA*e_log(P_notA))

  ent_B <- -(P_B*e_log(P_B) +
               P_notB*e_log(P_notB))

  ent_AB <- -(P_notA_notB*e_log(P_notA_notB) +
                P_A_notB*e_log(P_A_notB) +
                P_notA_B*e_log(P_notA_B) +
                P_A_B*e_log(P_A_B))

  ent_A + ent_B - ent_AB
}
