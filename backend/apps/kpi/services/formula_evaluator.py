"""
Safe AST Expression Evaluator for Universal KPI Engine.
Enforces strict sandboxing using Python's Abstract Syntax Tree.
Allows standard mathematical operations, safe functions, and parameters.
Blocks attribute access, dunders, imports, and arbitrary execution.
"""

import ast
import re
import math
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from typing import Dict, Any, Set, Tuple, Optional


class SafeFormulaError(Exception):
    pass


class DivisionByZeroError(SafeFormulaError):
    pass


def _safe_round(*args):
    if len(args) == 1:
        val = args[0]
        if isinstance(val, Decimal):
            return val.quantize(Decimal("1"), rounding=ROUND_HALF_UP)
        return round(val)
    elif len(args) == 2:
        val, places = args[0], int(args[1])
        if isinstance(val, Decimal):
            prec_str = "1." + ("0" * places) if places > 0 else "1"
            return val.quantize(Decimal(prec_str), rounding=ROUND_HALF_UP)
        return round(val, places)
    raise SafeFormulaError("round() takes 1 or 2 arguments.")


class SafeExpressionVisitor(ast.NodeVisitor):
    ALLOWED_BIN_OPS = {
        ast.Add: "+",
        ast.Sub: "-",
        ast.Mult: "*",
        ast.Div: "/",
        ast.FloorDiv: "//",
        ast.Mod: "%",
        ast.Pow: "**",
    }

    ALLOWED_UNARY_OPS = {
        ast.UAdd: "+",
        ast.USub: "-",
        ast.Not: "not",
    }

    ALLOWED_COMPARE_OPS = {
        ast.Eq: "==",
        ast.NotEq: "!=",
        ast.Lt: "<",
        ast.LtE: "<=",
        ast.Gt: ">",
        ast.GtE: ">=",
    }

    ALLOWED_FUNCTIONS = {
        "abs": abs,
        "round": _safe_round,
        "min": min,
        "max": max,
        "sum": lambda *args: sum(args[0]) if len(args) == 1 and isinstance(args[0], (list, tuple)) else sum(args),
        "avg": lambda *args: (sum(args[0]) / len(args[0])) if len(args) == 1 and isinstance(args[0], (list, tuple)) else (sum(args) / len(args)),
        "mean": lambda *args: (sum(args[0]) / len(args[0])) if len(args) == 1 and isinstance(args[0], (list, tuple)) else (sum(args) / len(args)),
        "sqrt": math.sqrt,
        "ceil": math.ceil,
        "floor": math.floor,
        "if_else": lambda cond, if_true, if_false: if_true if cond else if_false,
    }


    def __init__(self, allowed_variables: Optional[Set[str]] = None):
        self.allowed_variables = set(allowed_variables) if allowed_variables else None
        self.found_variables: Set[str] = set()

    def generic_visit(self, node):
        raise SafeFormulaError(f"Disallowed expression element: {type(node).__name__}")

    def visit_Expression(self, node):
        return self.visit(node.body)

    def visit_Expr(self, node):
        return self.visit(node.value)

    def visit_Constant(self, node):
        if isinstance(node.value, (int, float, bool, str, type(None))):
            return node.value
        raise SafeFormulaError(f"Disallowed literal value type: {type(node.value).__name__}")

    def visit_Name(self, node):
        if not isinstance(node.ctx, ast.Load):
            raise SafeFormulaError("Only loading variables is permitted.")
        var_name = node.id
        self.found_variables.add(var_name)
        if self.allowed_variables is not None and var_name not in self.allowed_variables and var_name.lower() not in self.ALLOWED_FUNCTIONS:
            raise SafeFormulaError(f"Unknown or unauthorized variable reference: '{var_name}'")
        return var_name

    def visit_BinOp(self, node):
        left = self.visit(node.left)
        right = self.visit(node.right)
        op_type = type(node.op)
        if op_type not in self.ALLOWED_BIN_OPS:
            raise SafeFormulaError(f"Unsupported binary operator: {op_type.__name__}")
        return (self.ALLOWED_BIN_OPS[op_type], left, right)

    def visit_UnaryOp(self, node):
        operand = self.visit(node.operand)
        op_type = type(node.op)
        if op_type not in self.ALLOWED_UNARY_OPS:
            raise SafeFormulaError(f"Unsupported unary operator: {op_type.__name__}")
        return (self.ALLOWED_UNARY_OPS[op_type], operand)

    def visit_Compare(self, node):
        left = self.visit(node.left)
        comparisons = []
        for op, comparator in zip(node.ops, node.comparators):
            op_type = type(op)
            if op_type not in self.ALLOWED_COMPARE_OPS:
                raise SafeFormulaError(f"Unsupported comparison operator: {op_type.__name__}")
            comp_val = self.visit(comparator)
            comparisons.append((self.ALLOWED_COMPARE_OPS[op_type], comp_val))
        return ("COMPARE", left, comparisons)

    def visit_BoolOp(self, node):
        op_name = "and" if isinstance(node.op, ast.And) else "or"
        values = [self.visit(val) for val in node.values]
        return ("BOOL", op_name, values)

    def visit_IfExp(self, node):
        test = self.visit(node.test)
        body = self.visit(node.body)
        orelse = self.visit(node.orelse)
        return ("IF_EXP", test, body, orelse)

    def visit_Call(self, node):
        if not isinstance(node.func, ast.Name):
            raise SafeFormulaError("Dynamic or nested method calls are strictly forbidden.")
        func_name = node.func.id
        if func_name.lower() not in self.ALLOWED_FUNCTIONS:
            raise SafeFormulaError(f"Function '{func_name}' is not in the approved safe calculation whitelist.")
        args = [self.visit(arg) for arg in node.args]
        return ("CALL", func_name.lower(), args)


class SafeFormulaEvaluator:
    @classmethod
    def preprocess_expression(cls, expression: str) -> Tuple[str, Dict[str, str]]:
        """
        Converts bracketed column references e.g. [Downtime] or [Total Time]
        into safe variable tokens e.g. col_downtime, and returns the token mapping.
        """
        if not expression:
            return "", {}
        bracket_pattern = re.compile(r'\[([^\]]+)\]')
        token_map: Dict[str, str] = {}

        def _replace_token(match):
            col_name = match.group(1).strip()
            clean_token = re.sub(r'[^a-zA-Z0-9_]', '_', col_name).strip('_')
            token = f"col_{clean_token}"
            token_map[token] = col_name
            return token

        cleaned = bracket_pattern.sub(_replace_token, expression)
        return cleaned, token_map

    @classmethod
    def validate_syntax(cls, expression: str, allowed_variables: Optional[Set[str]] = None) -> Tuple[bool, Optional[str], Set[str]]:
        """
        Parses expression into AST and validates strict compliance.
        Returns: (is_valid, error_message, detected_variables)
        """
        if not expression or not expression.strip():
            return True, None, set()

        cleaned_expr, token_map = cls.preprocess_expression(expression.strip())
        effective_allowed = set(allowed_variables) if allowed_variables else None
        if effective_allowed is not None and token_map:
            # Map column names in token_map to allowed variables
            for tok, orig_name in token_map.items():
                if orig_name in effective_allowed or orig_name.lower() in {v.lower() for v in effective_allowed}:
                    effective_allowed.add(tok)

        try:
            tree = ast.parse(cleaned_expr, mode="eval")
        except SyntaxError as e:
            return False, f"Syntax error at position {e.offset}: {e.msg}", set()


        visitor = SafeExpressionVisitor(effective_allowed)
        try:
            visitor.visit(tree)
            # Map detected variable tokens back to original names if from brackets
            mapped_vars = set()
            for v in visitor.found_variables:
                mapped_vars.add(token_map.get(v, v))
            return True, None, mapped_vars
        except SafeFormulaError as err:
            return False, str(err), visitor.found_variables
        except Exception as ex:
            return False, f"Invalid formula structure: {str(ex)}", visitor.found_variables

    @classmethod
    def evaluate(cls, expression: str, context: Dict[str, Any]) -> Decimal:
        """
        Safely evaluates validated expression within the given variable context.
        Raises DivisionByZeroError on 0 division, or SafeFormulaError on invalid types.
        """
        if not expression or not expression.strip():
            raise SafeFormulaError("Empty formula expression cannot be evaluated.")

        cleaned, token_map = cls.preprocess_expression(expression.strip())
        eval_context = dict(context)
        if token_map:
            for tok, orig_name in token_map.items():
                if orig_name in context:
                    eval_context[tok] = context[orig_name]
                else:
                    for k, v in context.items():
                        if k.strip().lower() == orig_name.strip().lower():
                            eval_context[tok] = v
                            break

        tree = ast.parse(cleaned, mode="eval")

        def _eval_node(node):
            if isinstance(node, ast.Expression):
                return _eval_node(node.body)

            if isinstance(node, ast.Constant):
                return node.value

            if isinstance(node, ast.Name):
                name = node.id
                val = eval_context.get(name)
                found = name in eval_context
                if not found:
                    name_lower = name.lower()
                    for k, v in eval_context.items():
                        if k.lower() == name_lower:
                            val = v
                            found = True
                            break
                if found:
                    if val is None:
                        return Decimal("0")
                    if isinstance(val, (int, float, Decimal)):
                        return Decimal(str(val))
                    try:
                        return Decimal(str(val).replace("%", "").strip())
                    except (InvalidOperation, ValueError):
                        return val
                raise SafeFormulaError(f"Missing required parameter value: '{token_map.get(name, name)}'")


            if isinstance(node, ast.UnaryOp):
                operand = _eval_node(node.operand)
                if isinstance(node.op, ast.USub):
                    return -operand
                if isinstance(node.op, ast.UAdd):
                    return +operand
                if isinstance(node.op, ast.Not):
                    return not operand

            if isinstance(node, ast.BinOp):
                left = _eval_node(node.left)
                right = _eval_node(node.right)
                
                left_dec = Decimal(str(left)) if not isinstance(left, Decimal) else left
                right_dec = Decimal(str(right)) if not isinstance(right, Decimal) else right

                if isinstance(node.op, ast.Add):
                    return left_dec + right_dec
                if isinstance(node.op, ast.Sub):
                    return left_dec - right_dec
                if isinstance(node.op, ast.Mult):
                    return left_dec * right_dec
                if isinstance(node.op, (ast.Div, ast.FloorDiv)):
                    if right_dec == Decimal("0"):
                        raise DivisionByZeroError(f"Division by zero in expression ({left_dec} / 0)")
                    if isinstance(node.op, ast.FloorDiv):
                        return Decimal(str(left_dec // right_dec))
                    return left_dec / right_dec
                if isinstance(node.op, ast.Mod):
                    if right_dec == Decimal("0"):
                        raise DivisionByZeroError("Modulo by zero")
                    return left_dec % right_dec
                if isinstance(node.op, ast.Pow):
                    return Decimal(str(float(left_dec) ** float(right_dec)))

            if isinstance(node, ast.Compare):
                left = _eval_node(node.left)
                current = left
                for op, comp in zip(node.ops, node.comparators):
                    right = _eval_node(comp)
                    res = False
                    if isinstance(op, ast.Eq):
                        res = (current == right)
                    elif isinstance(op, ast.NotEq):
                        res = (current != right)
                    elif isinstance(op, ast.Lt):
                        res = (current < right)
                    elif isinstance(op, ast.LtE):
                        res = (current <= right)
                    elif isinstance(op, ast.Gt):
                        res = (current > right)
                    elif isinstance(op, ast.GtE):
                        res = (current >= right)
                    if not res:
                        return False
                    current = right
                return True

            if isinstance(node, ast.BoolOp):
                if isinstance(node.op, ast.And):
                    return all(bool(_eval_node(v)) for v in node.values)
                return any(bool(_eval_node(v)) for v in node.values)

            if isinstance(node, ast.IfExp):
                cond = _eval_node(node.test)
                if cond:
                    return _eval_node(node.body)
                return _eval_node(node.orelse)

            if isinstance(node, ast.Call):
                raw_func_name = node.func.id if isinstance(node.func, ast.Name) else str(getattr(node.func, "id", ""))
                func_name = raw_func_name.lower()
                fn = SafeExpressionVisitor.ALLOWED_FUNCTIONS.get(func_name)
                if not fn:
                    raise SafeFormulaError(f"Function '{raw_func_name}' not permitted.")
                evaluated_args = [_eval_node(arg) for arg in node.args]
                raw_res = fn(*evaluated_args)
                return Decimal(str(raw_res)) if isinstance(raw_res, (int, float, Decimal)) else raw_res


            raise SafeFormulaError(f"Unsupported node type: {type(node).__name__}")

        raw_result = _eval_node(tree)
        if isinstance(raw_result, bool):
            return Decimal("1") if raw_result else Decimal("0")
        if isinstance(raw_result, Decimal):
            return raw_result
        try:
            return Decimal(str(raw_result))
        except (InvalidOperation, ValueError):
            raise SafeFormulaError(f"Expression result '{raw_result}' cannot be converted to Decimal.")
