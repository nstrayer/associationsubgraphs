// Generated by using Rcpp::compileAttributes() -> do not edit by hand
// Generator token: 10BE3573-1514-4C36-9D1C-5A225CD40393

#include <Rcpp.h>

using namespace Rcpp;

// calculate_subgraph_structure_rcpp
List calculate_subgraph_structure_rcpp(DataFrame associations, const String& a_col, const String& b_col, const String& w_col);
RcppExport SEXP _associationsubgraphs_calculate_subgraph_structure_rcpp(SEXP associationsSEXP, SEXP a_colSEXP, SEXP b_colSEXP, SEXP w_colSEXP) {
BEGIN_RCPP
    Rcpp::RObject rcpp_result_gen;
    Rcpp::RNGScope rcpp_rngScope_gen;
    Rcpp::traits::input_parameter< DataFrame >::type associations(associationsSEXP);
    Rcpp::traits::input_parameter< const String& >::type a_col(a_colSEXP);
    Rcpp::traits::input_parameter< const String& >::type b_col(b_colSEXP);
    Rcpp::traits::input_parameter< const String& >::type w_col(w_colSEXP);
    rcpp_result_gen = Rcpp::wrap(calculate_subgraph_structure_rcpp(associations, a_col, b_col, w_col));
    return rcpp_result_gen;
END_RCPP
}

static const R_CallMethodDef CallEntries[] = {
    {"_associationsubgraphs_calculate_subgraph_structure_rcpp", (DL_FUNC) &_associationsubgraphs_calculate_subgraph_structure_rcpp, 4},
    {NULL, NULL, 0}
};

RcppExport void R_init_associationsubgraphs(DllInfo *dll) {
    R_registerRoutines(dll, NULL, CallEntries, NULL, NULL);
    R_useDynamicSymbols(dll, FALSE);
}
