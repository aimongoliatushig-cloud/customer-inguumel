/**
 * Order status timeline – horizontal row of steps with connectors (done / active / todo).
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export type TimelineStepCode =
  | 'RECEIVED'
  | 'PREPARING'
  | 'PACKED'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'CANCELLED';

export interface TimelineStep {
  code: string;
  label: string;
  state: 'done' | 'active' | 'todo';
  timeText?: string;
}

interface OrderTimelineProps {
  steps: TimelineStep[];
}

const CIRCLE_SIZE = 40;
const CONNECTOR_HEIGHT = 3;
const LABEL_MIN_HEIGHT = 34;

const CONNECTOR_DONE = '#16a34a';
const CONNECTOR_ACTIVE = '#2563eb';
const CONNECTOR_TODO = '#e2e8f0';

/** Single connector segment: solid (done), half solid + half light (active), or light (todo). */
function ConnectorSegment({ state }: { state: 'done' | 'active' | 'todo' }) {
  if (state === 'done') {
    return <View style={[styles.connector, styles.connectorDone]} />;
  }
  if (state === 'active') {
    return (
      <View style={styles.connectorHalfWrap}>
        <View style={[styles.connectorHalf, styles.connectorDone]} />
        <View style={[styles.connectorHalf, styles.connectorTodo]} />
      </View>
    );
  }
  return <View style={[styles.connector, styles.connectorTodo]} />;
}

function StepCircle({ step, isLastDone }: { step: TimelineStep; isLastDone: boolean }) {
  const showTime = (step.state === 'active' || (step.state === 'done' && isLastDone)) && step.timeText;
  return (
    <View style={styles.circleBlock}>
      {showTime && (
        <Text style={styles.timeText} numberOfLines={1}>
          {step.timeText}
        </Text>
      )}
      {step.state === 'done' && (
        <View style={[styles.circle, styles.circleDone]}>
          <Ionicons name="checkmark" size={20} color="#fff" />
        </View>
      )}
      {step.state === 'active' && (
        <View style={[styles.circle, (step.code || '').toLowerCase() === 'cancelled' ? styles.circleCancelled : styles.circleActiveRing]}>
          <View style={styles.circleActiveDot} />
        </View>
      )}
      {step.state === 'todo' && <View style={[styles.circle, styles.circleTodo]} />}
    </View>
  );
}

export function OrderTimeline({ steps }: OrderTimelineProps) {
  const lastDoneIndex = steps.reduce((last, s, i) => (s.state === 'done' ? i : last), -1);

  return (
    <View style={styles.container}>
      {steps.map((step, index) => (
        <View key={`${step.code}-${index}`} style={styles.step}>
          <View style={styles.stepRow}>
            {index > 0 ? (
              <View style={styles.connectorWrap}>
                <ConnectorSegment state={steps[index - 1].state} />
              </View>
            ) : (
              <View style={styles.connectorWrap} />
            )}
            <StepCircle step={step} isLastDone={index === lastDoneIndex} />
            {index < steps.length - 1 ? (
              <View style={styles.connectorWrap}>
                <ConnectorSegment state={step.state} />
              </View>
            ) : (
              <View style={styles.connectorWrap} />
            )}
          </View>
          <View style={styles.labelContainer}>
            <Text style={styles.label} numberOfLines={2}>
              {step.label}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  step: {
    flex: 1,
    alignItems: 'center',
    minWidth: 0,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  connectorWrap: {
    flex: 1,
    height: CIRCLE_SIZE + 24,
    justifyContent: 'center',
    alignItems: 'stretch',
    paddingHorizontal: 2,
  },
  connector: {
    height: CONNECTOR_HEIGHT,
    borderRadius: 1,
  },
  connectorDone: {
    backgroundColor: CONNECTOR_DONE,
  },
  connectorTodo: {
    backgroundColor: CONNECTOR_TODO,
  },
  connectorHalfWrap: {
    flex: 1,
    flexDirection: 'row',
    height: CONNECTOR_HEIGHT,
  },
  connectorHalf: {
    flex: 1,
    height: CONNECTOR_HEIGHT,
    borderRadius: 1,
  },
  circleBlock: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    width: CIRCLE_SIZE,
    minHeight: 44,
    zIndex: 1,
  },
  timeText: {
    fontSize: 10,
    color: '#64748b',
    marginBottom: 4,
  },
  circle: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: CIRCLE_SIZE / 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  circleDone: {
    backgroundColor: CONNECTOR_DONE,
  },
  circleActiveRing: {
    borderWidth: 2,
    borderColor: CONNECTOR_ACTIVE,
    backgroundColor: '#eff6ff',
  },
  circleCancelled: {
    borderWidth: 2,
    borderColor: '#b91c1c',
    backgroundColor: '#fef2f2',
  },
  circleActiveDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: CONNECTOR_ACTIVE,
  },
  circleTodo: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: CONNECTOR_TODO,
  },
  labelContainer: {
    minHeight: LABEL_MIN_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  label: {
    fontSize: 11,
    color: '#64748b',
    textAlign: 'center',
  },
});
