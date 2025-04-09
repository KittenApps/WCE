// >= R115

interface PlayerCharacter {
  readonly ActiveExpression: (
    Partial<Record<ExpressionGroupName, ExpressionName>>
    & {
      setWithoutReload(key: ExpressionGroupName, value: ExpressionName): void;
      deleteWithoutReload(key: ExpressionGroupName): void;
    }
  );
}

declare const DialogSelfMenuMapping: { Expression: DialogMenu; Pose: DialogMenu };
